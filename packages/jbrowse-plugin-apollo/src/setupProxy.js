import { createProxyMiddleware } from 'http-proxy-middleware'
export default function (app) {
//   app.use(
//     '/auth/**',
//     createProxyMiddleware({
//       target: 'http://localhost:3999',
//       changeOrigin: true,
//     }),
//   )
//   app.use(
//     '/auth/google',
//     createProxyMiddleware({
//       target: 'http://localhost:3999',
//       changeOrigin: true,
//     }),
  //   )
  app.use(
    '/auth/google/login',
    createProxyMiddleware({
      target: 'http://localhost:3999',
    //   changeOrigin: true,
    }),
  )
  app.use(
    '/auth/google/redirect',
    createProxyMiddleware({
      target: 'http://localhost:3999',
    //   changeOrigin: true,
    }),
  )
  app.use(
    '/auth/google/**',
    createProxyMiddleware({
      target: 'http://localhost:3999',
    //   changeOrigin: true,
    }),
  )
  // eslint-disable-next-line no-undef
  //   app.use(proxy('/auth/google', { target: 'http://localhost:3999' }))
  // eslint-disable-next-line no-undef
  //   app.use(proxy('/auth/**', { target: 'http://localhost:3999' }))
}
