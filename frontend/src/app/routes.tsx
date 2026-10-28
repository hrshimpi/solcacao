// Every address in the app. All pages live under /en or /es.
import type { RouteObject } from "react-router";
import LoginPage from "../features/auth/LoginPage";
import RegisterPage from "../features/auth/RegisterPage";
import CatalogPage from "../features/catalog/CatalogPage";
import ContactPage from "../features/contact/ContactPage";
import HomePage from "../features/home/HomePage";
import ProductDetailPage from "../features/product/ProductDetailPage";
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
          { path: "account/login", element: <LoginPage /> },
          { path: "account/register", element: <RegisterPage /> },
          {
            path: "account/requests",
            element: (
              <RequestsAccessGuard>
                <MyRequestsPage />
              </RequestsAccessGuard>
            ),
          },
          { path: "profile", element: <ProfilePage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
