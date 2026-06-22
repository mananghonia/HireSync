from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from core.email import send_otp_email
from core.throttling import AuthRateThrottle, OTPRateThrottle
from .models import OTPVerification
from .serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    CustomTokenObtainPairSerializer,
    ChangePasswordSerializer,
)

User = get_user_model()


def _jwt_response(user):
    refresh = RefreshToken.for_user(user)
    return {
        "user": UserSerializer(user).data,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class SendRegistrationOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OTPRateThrottle]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({"detail": "An account with this email already exists."}, status=400)

        otp_obj = OTPVerification.generate(email)
        sent = send_otp_email(email, otp_obj.otp)
        if not sent:
            return Response({"detail": "Failed to send OTP. Try again."}, status=500)
        return Response({"detail": "Verification code sent to your email."})


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        otp = request.data.get("otp", "").strip()
        email = request.data.get("email", "").strip().lower()

        if not otp:
            return Response({"detail": "Email verification code is required."}, status=400)

        try:
            otp_obj = OTPVerification.objects.filter(
                email=email, otp=otp, is_used=False
            ).latest("created_at")
        except OTPVerification.DoesNotExist:
            return Response({"detail": "Invalid verification code."}, status=400)

        if not otp_obj.is_valid():
            return Response({"detail": "Verification code expired. Please request a new one."}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        otp_obj.is_used = True
        otp_obj.save(update_fields=["is_used"])

        refresh = RefreshToken.for_user(user)
        return Response({
            "user": UserSerializer(user).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
        }, status=status.HTTP_201_CREATED)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [AuthRateThrottle]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response({"old_password": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Password updated successfully."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    return Response({"detail": "Logged out successfully."})


# ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────────

class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        credential = request.data.get("credential")
        role = request.data.get("role")

        if not credential:
            return Response({"detail": "Google credential required."}, status=400)

        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as g_requests
            client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
            idinfo = id_token.verify_oauth2_token(credential, g_requests.Request(), client_id)
        except Exception as e:
            return Response({"detail": f"Invalid Google token: {e}"}, status=400)

        email = idinfo.get("email", "")
        first_name = idinfo.get("given_name", "")
        last_name = idinfo.get("family_name", "")
        google_id = idinfo.get("sub", "")

        if not email:
            return Response({"detail": "Could not retrieve email from Google."}, status=400)

        # Existing user
        try:
            user = User.objects.get(email=email)
            if not user.google_id:
                user.google_id = google_id
                user.is_verified = True
                user.save(update_fields=["google_id", "is_verified"])
            return Response(_jwt_response(user))
        except User.DoesNotExist:
            pass

        # New user — ask for role first
        if not role:
            return Response({
                "new_user": True,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
            }, status=200)

        if role not in (User.SEEKER, User.RECRUITER):
            return Response({"detail": "Invalid role."}, status=400)

        user = User.objects.create_user(
            email=email,
            password=None,
            first_name=first_name,
            last_name=last_name,
            role=role,
            google_id=google_id,
            is_verified=True,
        )
        return Response(_jwt_response(user), status=201)


# ─── FORGOT PASSWORD (OTP via Brevo) ─────────────────────────────────────────

class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "If that email exists, an OTP has been sent."})

        otp_obj = OTPVerification.generate(email)
        sent = send_otp_email(email, otp_obj.otp, user.get_full_name(), subject="HireSync — Password Reset Code")

        if not sent:
            return Response({"detail": "Failed to send email. Try again."}, status=500)

        return Response({"detail": "OTP sent to your email."})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "").strip()
        new_password = request.data.get("new_password", "")

        if not all([email, otp, new_password]):
            return Response({"detail": "Email, OTP, and new password are required."}, status=400)

        if len(new_password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=400)

        try:
            otp_obj = OTPVerification.objects.filter(
                email=email, otp=otp, is_used=False
            ).latest("created_at")
        except OTPVerification.DoesNotExist:
            return Response({"detail": "Invalid OTP."}, status=400)

        if not otp_obj.is_valid():
            return Response({"detail": "OTP expired. Please request a new one."}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        otp_obj.is_used = True
        otp_obj.save(update_fields=["is_used"])

        return Response({"detail": "Password reset successfully. You can now log in."})
