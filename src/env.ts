import {createEnv} from '@t3-oss/env-core'
import {z} from 'zod'

export default createEnv({
    server: {
        PASSWORD: z.string(),
        DATA_DIR: z.string().default('./data'),
        PORT: z.string()
            .transform((v) => parseInt(v, 10))
            .pipe(z.number())
            .default('31700'),
    },
    runtimeEnv: process.env,
    isServer: true,
})
