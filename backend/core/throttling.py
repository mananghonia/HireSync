from rest_framework.throttling import AnonRateThrottle


class AuthRateThrottle(AnonRateThrottle):
    scope = "auth"


class OTPRateThrottle(AnonRateThrottle):
    scope = "otp"
