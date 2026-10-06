import type { RouteObject } from "react-router";
import AuthPage from "../features/auth/AuthPage";
import CatalogPage from "../features/catalog/CatalogPage";
import HomePage from "../features/home/HomePage";
import ProductDetailPage from "../features/product/ProductDetailPage";
import SamplerPage from "../features/sampler/SamplerPage";
import NotFoundPage from "../features/shell/NotFoundPage";
import StudioPage from "../features/studio/StudioPage";
import WholesalePage from "../features/wholesale/WholesalePage";
import AppLayout from "./AppLayout";

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/shop", element: <CatalogPage /> },
      { path: "/shop/:slug", element: <ProductDetailPage /> },
      { path: "/wholesale", element: <WholesalePage /> },
      { path: "/wholesale/studio", element: <StudioPage /> },
      { path: "/login", element: <AuthPage /> },
      { path: "/register", element: <AuthPage /> },
      { path: "/sampler", element: <SamplerPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
