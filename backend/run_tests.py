"""
HireSync Full API Test Suite
Tests both seeker and recruiter flows end-to-end.
"""
import requests
import sys
from datetime import datetime

BASE = "http://localhost:8000/api/v1"
PASS = 0
FAIL = 0
FAILURES = []


def check(label, expected, actual, exact=False):
    global PASS, FAIL
    if callable(expected):
        ok = expected(actual)
    elif exact:
        ok = actual == expected
    else:
        ok = expected in str(actual)
    if ok:
        print(f"  [PASS] {label}")
        PASS += 1
    else:
        short = str(actual)[:150]
        print(f"  [FAIL] {label}")
        print(f"      expected: {expected!r}")
        print(f"      got:      {short}")
        FAIL += 1
        FAILURES.append((label, str(actual)[:300]))


def section(name):
    print(f"\n[ {name} ]")


def post(url, data, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.post(f"{BASE}{url}", json=data, headers=headers)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {}


def get(url, token=None, params=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.get(f"{BASE}{url}", headers=headers, params=params)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {}


def patch(url, data, token):
    r = requests.patch(f"{BASE}{url}", json=data, headers={"Authorization": f"Bearer {token}"})
    return r.status_code, r.json() if r.content else {}


# ─── AUTH ────────────────────────────────────────
section("AUTH: Register & Login")

SEEKER_EMAIL = f"seeker_{datetime.now().strftime('%H%M%S')}@test.com"
RECRUITER_EMAIL = f"recruiter_{datetime.now().strftime('%H%M%S')}@test.com"

code, data = post("/auth/register/", {
    "email": SEEKER_EMAIL, "password": "Test@9999", "password_confirm": "Test@9999",
    "first_name": "John", "last_name": "Doe", "role": "seeker"
})
check("Register new seeker (201)", lambda c: c in [200, 201], code, exact=True)
SEEKER_TOKEN = data.get("tokens", {}).get("access", "")

code, data = post("/auth/register/", {
    "email": RECRUITER_EMAIL, "password": "Test@9999", "password_confirm": "Test@9999",
    "first_name": "Alice", "last_name": "HR", "role": "recruiter"
})
check("Register new recruiter (201)", lambda c: c in [200, 201], code, exact=True)
REC_TOKEN = data.get("tokens", {}).get("access", "")

code, data = post("/auth/login/", {"email": "seeker@test.com", "password": "Test@1234"})
check("Login existing seeker (200)", 200, code, exact=True)
if data.get("access"):
    SEEKER_TOKEN = data["access"]

code, data = post("/auth/login/", {"email": "recruiter@test.com", "password": "Test@1234"})
check("Login existing recruiter (200)", 200, code, exact=True)
if data.get("access"):
    REC_TOKEN = data["access"]

code, data = get("/auth/me/", token=SEEKER_TOKEN)
check("/me returns seeker role", "seeker", data.get("role", ""))
check("/me has email", "@test.com", data.get("email", ""))

code, data = get("/auth/me/", token=REC_TOKEN)
check("/me returns recruiter role", "recruiter", data.get("role", ""))

code, _ = get("/auth/me/")
check("Unauthenticated /me returns 401", 401, code, exact=True)

code, data = post("/auth/login/", {"email": "nobody@x.com", "password": "wrong"})
check("Bad credentials returns 401", 401, code, exact=True)

# ─── PROFILES ────────────────────────────────────
section("PROFILES")

code, data = get("/profiles/seeker/", token=SEEKER_TOKEN)
check("Seeker profile returns 200", 200, code, exact=True)
check("Seeker profile has bio field", "bio", str(data))

code, _ = get("/profiles/seeker/", token=REC_TOKEN)
check("Recruiter blocked from seeker profile (403)", 403, code, exact=True)

code, data = get("/profiles/recruiter/", token=REC_TOKEN)
check("Recruiter profile returns 200", 200, code, exact=True)
check("Recruiter profile has job_title field", "job_title", str(data))

code, data = get("/profiles/skills/")
check("Skills list public (200)", 200, code, exact=True)
check("Skills list has items", lambda d: isinstance(d, (list, dict)), data)
skills = data.get("results", data) if isinstance(data, dict) else data
SKILL_ID = skills[0]["id"] if skills else ""
check("At least 1 skill exists", lambda x: len(x) > 0, SKILL_ID)

# ─── RECRUITER: COMPANY ──────────────────────────
section("RECRUITER: Company")

code, data = get("/profiles/companies/my_company/", token=REC_TOKEN)
check("GET my_company returns 200", 200, code, exact=True)
MY_COMPANY = data
COMPANY_ID = (data or {}).get("id", "")

if not COMPANY_ID:
    code, data = post("/profiles/companies/my_company/", {
        "name": "TestCorp API", "industry": "technology", "size": "11-50", "location": "Mumbai"
    }, token=REC_TOKEN)
    check("Create company returns 201", 201, code, exact=True)
    COMPANY_ID = data.get("id", "")
    check("Company has id", lambda x: len(str(x)) > 5, COMPANY_ID)
else:
    check("Recruiter already has company", lambda x: len(str(x)) > 5, COMPANY_ID)

code, _ = post("/profiles/companies/my_company/", {"name": "Hacker Corp"}, token=SEEKER_TOKEN)
check("Seeker blocked from creating company (403)", 403, code, exact=True)

# ─── RECRUITER: POST JOB ─────────────────────────
section("RECRUITER: Post Job")

code, data = post("/jobs/", {
    "title": "Test Automation Engineer",
    "description": "Build automated tests for our platform",
    "requirements": "2 years in testing",
    "company_id": COMPANY_ID,
    "skill_ids": [SKILL_ID] if SKILL_ID else [],
    "job_type": "full_time",
    "experience_level": "junior",
    "location": "Bangalore",
    "status": "active"
}, token=REC_TOKEN)
check("Post job returns 201", 201, code, exact=True)
check("Job has title", "Test Automation Engineer", str(data))
JOB_ID = data.get("id", "")
check("Job has id", lambda x: len(str(x)) > 5, JOB_ID)

code, _ = post("/jobs/", {"title": "Fake", "description": "x", "company_id": COMPANY_ID}, token=SEEKER_TOKEN)
check("Seeker blocked from posting job (403)", 403, code, exact=True)

# ─── JOB BROWSE ──────────────────────────────────
section("JOB BROWSE & SEARCH")

code, data = get("/jobs/")
check("Public job list returns 200", 200, code, exact=True)
check("Job list has results", lambda d: len((d.get("results", d) if isinstance(d, dict) else d)) > 0, data)

code, data = get("/jobs/", params={"search": "automation"})
check("Search by keyword returns 200", 200, code, exact=True)

code, data = get("/jobs/", params={"job_type": "full_time"})
check("Filter by job_type returns 200", 200, code, exact=True)

code, data = get(f"/jobs/{JOB_ID}/")
check("Job detail page returns 200", 200, code, exact=True)
check("Job detail has correct title", "Test Automation Engineer", str(data))

code, data = get(f"/jobs/{JOB_ID}/", token=SEEKER_TOKEN)
check("Authenticated job detail returns 200", 200, code, exact=True)
check("has_applied=false before applying", False, data.get("has_applied"), exact=True)
check("application_status=null before applying", None, data.get("application_status"), exact=True)

code, data = get("/jobs/", token=REC_TOKEN)
check("Recruiter can browse jobs too", 200, code, exact=True)

code, data = get("/jobs/my_jobs/", token=REC_TOKEN)
check("My Jobs returns 200", 200, code, exact=True)
my_jobs = data.get("results", data) if isinstance(data, dict) else data
check("Recruiter sees own job in My Jobs", "Test Automation Engineer", str(my_jobs))

# ─── SEARCH API ──────────────────────────────────
section("SEARCH")

code, data = get("/search/jobs/", params={"q": "automation"})
check("Search API returns 200", 200, code, exact=True)
check("Search returns results", "results", str(data))

# ─── SEEKER: APPLY ───────────────────────────────
section("SEEKER: Apply to Jobs")

code, data = post("/applications/my/", {"job": JOB_ID, "cover_letter": "I love testing!"}, token=SEEKER_TOKEN)
check("Apply to job returns 201", 201, code, exact=True)
check("Application status=applied", "applied", str(data))
APP_ID = data.get("id", "")
check("Application has id", lambda x: len(str(x)) > 5, APP_ID)

code, data = post("/applications/my/", {"job": JOB_ID, "cover_letter": "Duplicate"}, token=SEEKER_TOKEN)
check("Duplicate apply blocked (400)", 400, code, exact=True)
check("Duplicate error message", "already applied", str(data).lower())

code, data = get(f"/jobs/{JOB_ID}/", token=SEEKER_TOKEN)
check("has_applied=true after applying", True, data.get("has_applied"), exact=True)
check("application_status=applied on job detail", "applied", str(data.get("application_status", "")))

code, data = get("/applications/my/", token=SEEKER_TOKEN)
check("Seeker sees own application", 200, code, exact=True)
apps = data.get("results", data) if isinstance(data, dict) else data
check("Application list has the job", "Test Automation Engineer", str(apps))

code, _ = get("/applications/my/", token=REC_TOKEN)
check("Recruiter blocked from seeker applications", lambda c: c in [403, 400], code, exact=True)

# ─── WITHDRAW & RE-APPLY (test while status=applied) ─────
section("WITHDRAW & RE-APPLY")

code, data = post(f"/applications/my/{APP_ID}/withdraw/", {}, token=SEEKER_TOKEN)
check("Withdraw returns 200", 200, code, exact=True)
check("Status=withdrawn after withdraw", "withdrawn", str(data))

code, data = get(f"/jobs/{JOB_ID}/", token=SEEKER_TOKEN)
check("has_applied=false after withdraw", False, data.get("has_applied"), exact=True)
check("application_status=withdrawn", "withdrawn", str(data.get("application_status", "")))

code, data = post("/applications/my/", {"job": JOB_ID, "cover_letter": "Re-applying!"}, token=SEEKER_TOKEN)
check("Re-apply after withdraw returns 201", 201, code, exact=True)
check("Status=applied after re-apply", "applied", str(data))

code, data = get(f"/jobs/{JOB_ID}/", token=SEEKER_TOKEN)
check("has_applied=true after re-apply", True, data.get("has_applied"), exact=True)

# ─── RECRUITER: APPLICANT MANAGEMENT ─────────────
section("RECRUITER: Application Management")

code, data = get("/applications/manage/", token=REC_TOKEN, params={"job_id": JOB_ID})
check("Recruiter sees applicants", 200, code, exact=True)
rec_apps = data.get("results", data) if isinstance(data, dict) else data
check("Applicant list has seeker", lambda x: len(x) > 0, rec_apps)

code, data = get("/applications/manage/", token=SEEKER_TOKEN)
check("Seeker blocked from recruiter applicants (403)", 403, code, exact=True)

r = requests.patch(f"{BASE}/applications/manage/{APP_ID}/update_status/",
                   json={"status": "shortlisted", "note": "Excellent candidate"},
                   headers={"Authorization": f"Bearer {REC_TOKEN}"})
code, data = r.status_code, (r.json() if r.content else {})
check("Update status to shortlisted (200)", 200, code, exact=True)
check("Status=shortlisted in response", "shortlisted", str(data))

code, data = get("/applications/my/", token=SEEKER_TOKEN)
apps = data.get("results", data) if isinstance(data, dict) else data
check("Seeker sees updated status", "shortlisted", str(apps))

# Test full pipeline: shortlisted → interview → hired
for new_status in ["interview_scheduled", "hired"]:
    r = requests.patch(f"{BASE}/applications/manage/{APP_ID}/update_status/",
                       json={"status": new_status},
                       headers={"Authorization": f"Bearer {REC_TOKEN}"})
    code, data = r.status_code, (r.json() if r.content else {})
    check(f"Status updated to {new_status}", new_status, str(data))

# ─── ANALYTICS ───────────────────────────────────
section("ANALYTICS")

code, data = get("/analytics/recruiter/dashboard/", token=REC_TOKEN)
check("Recruiter dashboard returns 200", 200, code, exact=True)
check("Dashboard has overview", "overview", str(data))
overview = data.get("overview", {})
check("total_jobs >= 1", lambda x: x >= 1, overview.get("total_jobs", 0))
check("total_applications >= 1", lambda x: x >= 1, overview.get("total_applications", 0))
check("status_breakdown present", "status_breakdown", str(data))
check("top_jobs present", "top_jobs", str(data))
check("daily_applications present", "daily_applications", str(data))

code, data = get(f"/analytics/recruiter/jobs/{JOB_ID}/", token=REC_TOKEN)
check("Job analytics returns 200", 200, code, exact=True)
check("Job analytics has views", "views", str(data))
check("Job analytics has applications", "applications", str(data))

code, _ = get("/analytics/recruiter/dashboard/", token=SEEKER_TOKEN)
check("Seeker blocked from analytics (403)", 403, code, exact=True)

# ─── SAVED JOBS ──────────────────────────────────
section("SAVED JOBS")

code, data = get("/jobs/saved/", token=SEEKER_TOKEN)
check("Saved jobs list returns 200", 200, code, exact=True)

code, data = post("/jobs/saved/", {"job_id": JOB_ID}, token=SEEKER_TOKEN)
check("Save job returns 200/201", lambda c: c in [200, 201], code, exact=True)

code, data = get("/jobs/saved/", token=SEEKER_TOKEN)
check("Saved jobs has the saved job", JOB_ID, str(data))

# Unsave
code, data = post("/jobs/saved/", {"job_id": JOB_ID}, token=SEEKER_TOKEN)
check("Toggle save (unsave) returns 200", 200, code, exact=True)

# ─── JOB MANAGEMENT ──────────────────────────────
section("RECRUITER: Edit & Close Job")

code, data = patch(f"/jobs/{JOB_ID}/", {"title": "Updated: Test Automation Lead"}, token=REC_TOKEN)
check("Recruiter can update own job", 200, code, exact=True)
check("Title updated in response", "Updated", str(data))

code, _ = patch(f"/jobs/{JOB_ID}/", {"title": "Hacked"}, token=SEEKER_TOKEN)
check("Seeker cannot edit job (403)", 403, code, exact=True)

# Close job
code, data = patch(f"/jobs/{JOB_ID}/", {"status": "closed"}, token=REC_TOKEN)
check("Recruiter can close own job (200)", 200, code, exact=True)

# ─── LOGOUT ──────────────────────────────────────
section("LOGOUT")

code, data = post("/auth/logout/", {"refresh": "dummy"}, token=SEEKER_TOKEN)
check("Seeker logout returns 200", 200, code, exact=True)

code, data = post("/auth/logout/", {"refresh": "dummy"}, token=REC_TOKEN)
check("Recruiter logout returns 200", 200, code, exact=True)

# ─── SUMMARY ─────────────────────────────────────
total = PASS + FAIL
print(f"\n{'='*55}")
print(f"  Results: {PASS} passed  |  {FAIL} failed  |  {total} total")
print(f"{'='*55}")

if FAILURES:
    print(f"\nFailed tests:")
    for label, detail in FAILURES:
        print(f"  - {label}")
        print(f"    {detail[:200]}")

sys.exit(0 if FAIL == 0 else 1)
