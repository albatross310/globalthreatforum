import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("posts/:slug", "routes/post.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("logout", "routes/logout.tsx"),
  route("write/:id?", "routes/write.tsx"),
  route("me/posts", "routes/my-posts.tsx"),
  route("admin/review", "routes/admin-review.tsx"),
  route("admin/review/:id", "routes/admin-review-post.tsx"),
  route("api/upload", "routes/api.upload.ts"),
  route("api/cron/anchor", "routes/api.cron.anchor.ts"),
  route("api/timestamp/comment/:id", "routes/api.timestamp.comment.ts"),
  route("api/timestamp/:slug", "routes/api.timestamp.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
] satisfies RouteConfig;
