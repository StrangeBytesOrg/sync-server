import {Elysia, t} from 'elysia'
import {cors} from '@elysiajs/cors'
import {swagger} from '@elysiajs/swagger'
import {JSONFilePreset} from 'lowdb/node'
import {jwtVerify} from 'jose'
import path from 'path'
import env from './env'

type Doc = {
    id: string
    lastUpdate: number
    [key: string]: any
}
type Collection = Record<string, Doc>

const getUserDB = (user: string) => {
    // Sanitize username
    const safeUser = user.replace(/[^a-zA-Z0-9_-]/g, '')
    if (!safeUser || safeUser !== user) throw new Error('Invalid username format')
    const dbPath = path.resolve(path.join(env.DATA_DIR, `${safeUser}.json`))
    return JSONFilePreset<Record<string, Collection>>(dbPath, {})
}

const routes = new Elysia()
    .guard({headers: t.Object({token: t.String()})})
    .derive(async ({headers}) => {
        const secret = new TextEncoder().encode(env.JWT_SECRET)
        const {payload} = await jwtVerify(headers.token, secret, {requiredClaims: ['sub']})
        if (!payload.sub) throw new Error('Invalid token')
        return {user: payload.sub}
    })
    .get('/list', async ({user}) => {
        const db = await getUserDB(user)
        const list = []
        for (const collection in db.data) {
            for (const key in db.data[collection]) {
                if (!db.data[collection][key]) continue
                list.push({
                    key,
                    collection,
                    lastUpdate: db.data[collection][key].lastUpdate,
                })
            }
        }
        return list
    }, {
        response: t.Array(t.Object({
            key: t.String(),
            collection: t.String(),
            lastUpdate: t.Number(),
        })),
    })
    .put('/upload/', async ({body, user}) => {
        const {key, collection, doc} = body
        const db = await getUserDB(user)
        if (!db.data[collection]) {
            db.data[collection] = {}
        }
        db.data[collection][key] = doc
        await db.write()
        return {success: true}
    }, {
        body: t.Object({
            key: t.String(),
            collection: t.String(),
            doc: t.Object({
                id: t.String(),
                lastUpdate: t.Number(),
            }),
        }, {additionalProperties: true}),
    })
    .get('/download/:collection/:key', async ({params, user, set}) => {
        const {key, collection} = params
        const db = await getUserDB(user)
        if (!db.data[collection]) {
            set.status = 404
            throw new Error('Collection not found')
        }
        const doc = db.data[collection][key]
        if (!doc) {
            set.status = 404
            throw new Error('Document not found')
        }
        return doc
    }, {
        response: t.Object({
            id: t.String(),
            lastUpdate: t.Number(),
        }, {additionalProperties: true}),
    })

const app = new Elysia()
    .use(cors())
    .use(swagger({
        provider: 'swagger-ui',
        path: '/docs',
        documentation: {
            info: {
                title: 'Cybermuse Sync Server',
                version: '0.1.0',
            },
        },
    }))
    .use(routes)

const server = Bun.serve({
    fetch: app.fetch,
    port: env.PORT,
    development: false,
})
console.log(`Sync Server running on port ${server.port}`)

// Handle shutdown signals
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...')
    server.stop()
    process.exit(0)
})

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...')
    server.stop()
    process.exit(0)
})
