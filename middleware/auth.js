const requireLogin = (req, res, next) => {
    // This check is necessary if the issue is a race condition between session initialization and route access.
    if (!req.session || !req.session.user) {
        return res.redirect("/login");
    }
    next();
};

export default requireLogin;