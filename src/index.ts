import {Elysia, t} from 'elysia'
import {cors} from '@elysiajs/cors'
import {swagger} from '@elysiajs/swagger'
import {bearer} from '@elysiajs/bearer'
import {JSONFilePreset} from 'lowdb/node'
import path from 'path'
import env from './env'
import pkg from '../package.json'

type Doc = {
    lastUpdate: number
    version: number
    [key: string]: any
}
type Deletion = {
    deletedAt: number
}
type DB = {documents: Record<string, Doc>; deletions: Record<string, Deletion>}

const getDb = () => {
    const dbPath = path.resolve(path.join(env.DATA_DIR, `db.json`))
    return JSONFilePreset<DB>(dbPath, {documents: {}, deletions: {}})
}

const routes = new Elysia({tags: ['Sync']})
    .use(bearer())
    .guard({detail: {security: [{bearerAuth: []}]}})
    .derive(async ({bearer, error}) => {
        if (!bearer || bearer !== env.PASSWORD) {
            return error(403, 'Unauthorized')
        }
    })
    .get('/list', async () => {
        const db = await getDb()
        return {
            documents: Object.entries(db.data.documents).map(([key, doc]) => ({
                key,
                lastUpdate: doc.lastUpdate,
                version: doc.version,
            })),
            deletions: Object.entries(db.data.deletions).map(([key, {deletedAt}]) => ({
                key,
                deletedAt,
            })),
        }
    }, {
        response: t.Object({
            documents: t.Array(t.Object({
                key: t.String(),
                lastUpdate: t.Number(),
                version: t.Number(),
            })),
            deletions: t.Array(t.Object({
                key: t.String(),
                deletedAt: t.Number(),
            })),
        }),
    })
    .put('/upload', async ({body, error}) => {
        const db = await getDb()
        const {key, doc} = body
        if (!key || !doc || typeof key !== 'string' || typeof doc !== 'object') {
            return error(400, 'Invalid request body')
        }
        db.data.documents[key] = doc
        await db.write()
        return {success: true}
    }, {
        body: t.Object({
            key: t.String(),
            doc: t.Intersect([
                t.Object({
                    id: t.String(),
                    lastUpdate: t.Number(),
                    version: t.Number(),
                }),
                t.Record(t.String(), t.Any()),
            ]),
        }),
    })
    .get('/download/:key', async ({params, error}) => {
        const key = decodeURIComponent(params.key)
        const db = await getDb()
        const doc = db.data.documents[key]
        if (!doc) return error(404, 'Document not found')
        return doc
    }, {
        response: {
            200: t.Object({
                lastUpdate: t.Number(),
                version: t.Number(),
            }, {additionalProperties: true}),
            404: t.String(),
        },
    })
    .post('/download', async ({body, error}) => {
        const db = await getDb()
        const documents = []
        for (const key of body.keys) {
            const doc = db.data.documents[key]
            if (!doc) return error(404, `Document not found: ${key}`)
            documents.push({key, document: doc})
        }
        return documents
    }, {
        body: t.Object({
            keys: t.Array(t.String()),
        }),
        response: {
            200: t.Array(t.Object({
                key: t.String(),
                document: t.Object({
                    lastUpdate: t.Number(),
                    version: t.Number(),
                }, {additionalProperties: true}),
            })),
            404: t.String(),
        },
    })
    .delete('/', async ({body}) => {
        const db = await getDb()
        const {key, deletedAt} = body
        if (db.data.documents[key]) {
            delete db.data.documents[key]
        }
        if (!db.data.deletions[key]) {
            db.data.deletions[key] = {deletedAt}
        }
        await db.write()
        return {success: true}
    }, {
        body: t.Object({
            key: t.String(),
            deletedAt: t.Number(),
        }),
    })

const app = new Elysia()
    .use(cors({origin: '*'}))
    .use(swagger({
        provider: 'swagger-ui',
        path: '/docs',
        documentation: {
            info: {
                title: 'Cybermuse Sync Server',
                version: pkg.version,
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                    },
                },
            },
        },
        swaggerOptions: {
            persistAuthorization: true,
            tryItOutEnabled: true,
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
