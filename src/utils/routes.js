// Where a signed-in person's account starts.
export function accountHome(user) {
  return user?.role === "admin" ? "/admin/dashboard" : "/user/home";
}
