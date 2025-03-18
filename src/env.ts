import {createEnv} from '@t3-oss/env-core'
import {z} from 'zod'

export default createEnv({
    server: {
        JWT_SECRET: z.string(),
        PORT: z.string()
            .transform((v) => parseInt(v, 10))
            .pipe(z.number())
            .default('31700'),
        DATA_DIR: z.string().default('./data'),
    },
    runtimeEnv: process.env,
    isServer: true,
})
