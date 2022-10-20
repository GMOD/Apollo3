export interface PayloadObject {
  username: string
  sub: number
  roles: ('admin' | 'user' | 'readOnly')[]
}
