import {createEnv} from '@t3-oss/env-core'
import {z} from 'zod'

export default createEnv({
    server: {
        PASSWORD: z.string(),
        DATA_DIR: z.string().default('./'),
        PORT: z.string()
            .transform((v) => parseInt(v, 10))
            .pipe(z.number())
            .default('31700'),
        MAX_UPLOAD_SIZE: z.string()
            .transform((v) => parseInt(v, 10))
            .pipe(z.number())
            .default('10'), // 10MB default
    },
    runtimeEnv: process.env,
    isServer: true,
})
