export default function clearCookies() {
  return (_, res, next) => {
    res.clearCookie('userId');
    res.clearCookie('userPicture');
    next();
  };
}
