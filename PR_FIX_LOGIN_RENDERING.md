# Pull Request: Fix /login rendering bug

This branch fixes an issue where the login page stays stuck on the "Verificando acceso..." spinner when opening /login. The change ensures the login page renders immediately by marking the route as authorized when pathname starts with /login, while preserving the redirect behavior for other routes.

- Title: Fix: /login stuck on "Verificando acceso" — allow login page to render
- Body:
  - What: Avoids infinite spinner on /login by allowing the login page to render immediately.
  - How: If the pathname starts with /login, setAutorizado(true) so the login form is shown; for other routes, preserve redirect to /login when unauthenticated.
  - Tests: Open /login in local or PR preview and confirm the login form appears; navigate to a protected route without session and confirm redirection to /login.
