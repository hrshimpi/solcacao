// Every address in the app. All pages live under /en or /es.
import type { RouteObject } from "react-router";
import RequireAuth from "../features/auth/components/RequireAuth";
import ForgotPasswordPage from "../features/auth/ForgotPasswordPage";
import LoginPage from "../features/auth/LoginPage";
import RegisterPage from "../features/auth/RegisterPage";
import ResetPasswordPage from "../features/auth/ResetPasswordPage";
import CatalogPage from "../features/catalog/CatalogPage";
import CheckoutPage from "../features/checkout/CheckoutPage";
import ContactPage from "../features/contact/ContactPage";
import HomePage from "../features/home/HomePage";
import InfoPage from "../features/info/InfoPage";
import OrderDetailPage from "../features/orders/OrderDetailPage";
import OrdersPage from "../features/orders/OrdersPage";
import ProductDetailPage from "../features/product/ProductDetailPage";
import AddressesPage from "../features/profile/AddressesPage";
import ProfilePage from "../features/profile/ProfilePage";
import MyRequestsPage from "../features/requests/MyRequestsPage";
import RequestsAccessGuard from "../features/requests/RequestsAccessGuard";
import SamplerPage from "../features/sampler/SamplerPage";
import NotFoundPage from "../features/shell/NotFoundPage";
import StudioPage from "../features/studio/StudioPage";
import StudioAccessGuard from "../features/wholesale/components/StudioAccessGuard";
import WholesalePage from "../features/wholesale/WholesalePage";
import AppLayout from "./AppLayout";
import LangGate from "./LangGate";
import RedirectToLanguage from "./RedirectToLanguage";

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <RedirectToLanguage /> },
      {
        path: ":lang",
        element: <LangGate />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "shop", element: <CatalogPage /> },
          { path: "shop/:slug", element: <ProductDetailPage /> },
          { path: "wholesale", element: <WholesalePage /> },
          {
            path: "wholesale/studio",
            element: (
              <StudioAccessGuard>
                <StudioPage />
              </StudioAccessGuard>
            ),
          },
          { path: "sampler", element: <SamplerPage /> },
          { path: "contact", element: <ContactPage /> },
          { path: "info/:topic", element: <InfoPage /> },
          { path: "account/login", element: <LoginPage /> },
          { path: "account/register", element: <RegisterPage /> },
          { path: "account/forgot-password", element: <ForgotPasswordPage /> },
          { path: "account/reset-password", element: <ResetPasswordPage /> },
          {
            path: "account/requests",
            element: (
              <RequestsAccessGuard>
                <MyRequestsPage />
              </RequestsAccessGuard>
            ),
          },
          {
            path: "checkout",
            element: (
              <RequireAuth>
                <CheckoutPage />
              </RequireAuth>
            ),
          },
          {
            path: "account/orders",
            element: (
              <RequireAuth>
                <OrdersPage />
              </RequireAuth>
            ),
          },
          {
            path: "account/orders/:id",
            element: (
              <RequireAuth>
                <OrderDetailPage />
              </RequireAuth>
            ),
          },
          {
            path: "profile",
            element: (
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            ),
          },
          {
            path: "profile/addresses",
            element: (
              <RequireAuth>
                <AddressesPage />
              </RequireAuth>
            ),
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
