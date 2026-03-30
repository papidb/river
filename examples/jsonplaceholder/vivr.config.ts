import { defineConfig } from '../../src/config/types.js'

export default defineConfig({
  name: 'jsonplaceholder-example',

  environments: {
    dev: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
    },
  },

  defaultEnv: 'dev',

  defaults: {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  },
})
