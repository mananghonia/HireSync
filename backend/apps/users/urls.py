from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    SendRegistrationOTPView,
    CustomTokenObtainPairView,
    MeView,
    ChangePasswordView,
    GoogleAuthView,
    ForgotPasswordView,
    ResetPasswordView,
    logout_view,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("send-registration-otp/", SendRegistrationOTPView.as_view(), name="send_registration_otp"),
    path("login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("logout/", logout_view, name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("google/", GoogleAuthView.as_view(), name="google_auth"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
]
