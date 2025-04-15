export default interface IsLogger {
  warn: (msg: any) => void,
  info: (msg: any) => void,
  debug: (msg: any) => void,
}
