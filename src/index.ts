import {Elysia, t} from 'elysia'
import {cors} from '@elysiajs/cors'
import {swagger} from '@elysiajs/swagger'
import {JSONFilePreset} from 'lowdb/node'
import path from 'path'
import env from './env'
import pkg from '../package.json'

type Doc = {
    id: string
    lastUpdate: number
    [key: string]: any
}
type Collection = Record<string, Doc>

const getDb = () => {
    const dbPath = path.resolve(path.join(env.DATA_DIR, `db.json`))
    return JSONFilePreset<Record<string, Collection>>(dbPath, {})
}

const routes = new Elysia()
    .guard({headers: t.Object({authorization: t.String()})})
    .derive(async ({headers, set}) => {
        const password = headers.authorization.split(' ')[1]
        if (password !== env.PASSWORD) {
            set.status = 403
            throw new Error('Unauthorized')
        }
    })
    .get('/list', async () => {
        const db = await getDb()
        const list = []
        for (const collection in db.data) {
            for (const key in db.data[collection]) {
                if (!db.data[collection][key]) continue
                list.push({
                    key,
                    collection,
                    lastUpdate: db.data[collection][key].lastUpdate,
                    deleted: db.data[collection][key].deleted,
                })
            }
        }
        return list
    }, {
        response: t.Array(t.Object({
            key: t.String(),
            collection: t.String(),
            lastUpdate: t.Number(),
            deleted: t.Optional(t.Number()),
        })),
    })
    .put('/upload', async ({body}) => {
        const db = await getDb()
        for (const item of body) {
            const {key, collection, doc} = item
            if (!db.data[collection]) {
                db.data[collection] = {}
            }
            db.data[collection][key] = doc
        }
        await db.write()
        return {success: true}
    }, {
        body: t.Array(
            t.Object({
                key: t.String(),
                collection: t.String(),
                doc: t.Object({
                    id: t.String(),
                    lastUpdate: t.Number(),
                }, {additionalProperties: true}),
            }),
        ),
    })
    .get('/download/:collection/:key', async ({params, set}) => {
        const {key, collection} = params
        const db = await getDb()
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
console.log(`Cybermuse Sync Server - version ${pkg.version}`)
console.log(`running on port ${server.port}`)

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
