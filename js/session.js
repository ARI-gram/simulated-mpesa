const SESSION_KEYS = {
  loggedInCustomerId: "mpesa_session_customer_id",
  loginFailCount: "mpesa_login_fail_count",
  loginLockUntil: "mpesa_login_lock_until",
};

const Session = {
  getLoggedInCustomerId() {
    const id = localStorage.getItem(SESSION_KEYS.loggedInCustomerId);
    return id ? parseInt(id, 10) : null;
  },
  setLoggedInCustomerId(id) {
    localStorage.setItem(SESSION_KEYS.loggedInCustomerId, String(id));
  },
  clearSession() {
    localStorage.removeItem(SESSION_KEYS.loggedInCustomerId);
  },
  getLoginLockUntil() {
    const t = localStorage.getItem(SESSION_KEYS.loginLockUntil);
    return t ? parseInt(t, 10) : null;
  },
  registerFailedLogin() {
    const count =
      parseInt(localStorage.getItem(SESSION_KEYS.loginFailCount) || "0", 10) +
      1;
    if (count >= 3) {
      localStorage.setItem(
        SESSION_KEYS.loginLockUntil,
        String(Date.now() + 30000),
      );
      localStorage.setItem(SESSION_KEYS.loginFailCount, "0");
    } else {
      localStorage.setItem(SESSION_KEYS.loginFailCount, String(count));
    }
  },
  clearLoginLock() {
    localStorage.removeItem(SESSION_KEYS.loginFailCount);
    localStorage.removeItem(SESSION_KEYS.loginLockUntil);
  },
};
