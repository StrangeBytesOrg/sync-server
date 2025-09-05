import {Elysia, t} from 'elysia'
import {cors} from '@elysiajs/cors'
import {swagger} from '@elysiajs/swagger'
import {bearer} from '@elysiajs/bearer'
import {JSONFilePreset} from 'lowdb/node'
import path from 'path'
import env from './env'
import pkg from '../package.json'

type Doc = {
    id: string
    lastUpdate: number
    version: number
    [key: string]: any
}
type Deletion = {
    id: string
    collection: string
    deletedAt: number
}
type Collection = Record<string, Doc>
type DB = {documents: Record<string, Collection>; deletions: Record<string, Deletion>}

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
        const list = []
        for (const collection in db.data.documents) {
            for (const key in db.data.documents[collection]) {
                if (!db.data.documents[collection][key]) continue
                list.push({
                    key,
                    collection,
                    lastUpdate: db.data.documents[collection][key].lastUpdate,
                    version: db.data.documents[collection][key].version || 0,
                })
            }
        }
        const deletions = []
        for (const key in db.data.deletions) {
            if (!db.data.deletions[key]) continue
            deletions.push({
                id: db.data.deletions[key].id,
                collection: db.data.deletions[key].collection,
                deletedAt: db.data.deletions[key].deletedAt,
            })
        }
        return {documents: list, deletions}
    }, {
        response: t.Object({
            documents: t.Array(t.Object({
                key: t.String(),
                collection: t.String(),
                lastUpdate: t.Number(),
                version: t.Number(),
            })),
            deletions: t.Array(t.Object({
                id: t.String(),
                collection: t.String(),
                deletedAt: t.Number(),
            })),
        }),
    })
    .put('/upload', async ({body}) => {
        const db = await getDb()
        const documents = db.data.documents
        for (const {key, collection, doc} of body.documents) {
            if (!documents[collection]) {
                documents[collection] = {}
            }
            documents[collection][key] = doc
        }
        // Process deletions
        for (const {id, collection, deletedAt} of body.deletions) {
            if (documents[collection] && documents[collection][id]) {
                delete documents[collection][id]
            }
            if (!db.data.deletions[id]) {
                db.data.deletions[id] = {id, collection, deletedAt}
            }
        }
        await db.write()
        return {success: true}
    }, {
        body: t.Object({
            documents: t.Array(t.Object({
                key: t.String(),
                collection: t.String(),
                doc: t.Intersect([
                    t.Object({
                        id: t.String(),
                        lastUpdate: t.Number(),
                        version: t.Number(),
                    }),
                    t.Record(t.String(), t.Any()),
                ]),
            })),
            deletions: t.Array(t.Object({
                id: t.String(),
                collection: t.String(),
                deletedAt: t.Number(),
            })),
        }),
    })
    .get('/download/:collection/:key', async ({params, error}) => {
        const {key, collection} = params
        const db = await getDb()
        const documents = db.data.documents
        if (!documents[collection]) {
            return error(404, 'Collection not found')
        }
        const doc = documents[collection][key]
        if (!doc) {
            return error(404, 'Document not found')
        }
        doc.version = doc.version || 0
        return doc
    }, {
        response: {
            200: t.Object({
                id: t.String(),
                lastUpdate: t.Number(),
                version: t.Number(),
            }, {additionalProperties: true}),
            404: t.String(),
        },
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
