import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("claim", "routes/claim.tsx"),
] satisfies RouteConfig
