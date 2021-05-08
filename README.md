# agile-graphql

A GraphQL client wrapper for the frontend. This package provides a fluent query builder and a Prisma.js schema delegation style CRUD for a more intuitive queries.



## :green_heart: Features
* Predefine models once and perform crud queries without repeating yourself
* Dynamic curd and query operations
* Query Mapping for Vue Components




## Installation

```bash
npm i @moirei/agile-graphql
```



### Configuration

Although optional, but recommended. If no configuration provided, query fields must be passed as the last argument to every query/mutation.

See [full configuration](docs/configuration.md).

```javascript
const config = {
  defaults: {
    keyField: 'id',
    query: {
      findUnique: ['id', 'name'], // default query fields for all models
    },
  },
  // Only needed for CRUD operations
  crud: {
    users: {
      query: ['id', 'name', 'email'], // default query fields
      fetchPolicy: 'no-cache',
    },
    orders: {
      query: ['reference', 'total', 'items{ id quantity }'],
      keyField: 'reference',
      fetchPolicy: {
        findUnique: 'network-only',
      },
    },
  },
}
```



## Usage

```javascript
import { Graph } from '@moirei/agile-graphql'
import { ApolloClient } from 'apollo-client'

const apollo = new ApolloClient({
  uri: 'https://graphql.example.com'
})

// config is optional
const graph = new Graph(apollo, config)
```



### Query Builder

The query builder is based on [gql-query-builder](https://github.com/atulmy/gql-query-builder).

Operations:

| Name           | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `query`        | For Query operations                                         |
| `mutation`     | For Mutation operations                                      |
| `subscription` | For Subscriptions                                            |
| `raw`          | Build and get the raw query without performing the request. Access this value then access the above |

Example query

```javascript
const user = await graph.query.user(['id', 'name'], {
    where: {
        value: { id: '1' },
        type: 'UserWhereUniqueInput',
        required: true,
    },
})

const users = await graph.query.users('id name reviews{ rating }')
```

Example mutation

```javascript
const data = { name: 'James Bomd' }
const user = await graph.mutation.createOneUser(
  ['id', 'name'],
  {
    data: {
      type: 'UserCreateInput',
      value: data,
      required: true
    }
  }
)
```



#### Nested Queries

```javascript
// order
const users = await this.$graph.query.users([
    'id', 'name', 'email',
    (q) => {
        q.orders([
          'id', 'total',
          (q) => {
            q.items([
              'id', 'quantity',
            ])
          }
        ])
        q.reviews('rating', {
            limit: 100
        })
    }
])
```

The above performs the following query

```javascript
{
  "query": "query ($limit: Int) { users  { id, name, email, orders  { id, total, items  { id, quantity } }, reviews (limit: $limit) { rating } } }",
  "variables": {
    "limit": 100
  }
}
```



#### Raw Queries

Resolve your query without performing the request.

Does not return a promise.

```javascript
const raw = this.$graph.raw.query.users([
  'id',
  'name',
  (q) => {
    q.reviews('rating', { limit: 100 })
  },
])
```



### CRUD

Accessing anything other than `query`, `mutation`, `subscription`, `raw` is regarded as a crud operation.

Assumes your backend is [Prisma.js CRUD](https://www.prisma.io/docs/concepts/components/prisma-client/crud) style.

```javascript
// use default fields
const user = await graph.users.findUnique(where)

// or specify fields
const user = await graph.users.findUnique(where, ['id', 'name'])
// or
const user = await graph.users.findUnique(where, `
  id name
  orders{ id total }
`)

// query reviews dynamically
const reviews = await graph.reviews.findMany(['id', 'rating']);
```



### Methods

| Name                                                 | Type       | Description                             |
| ---------------------------------------------------- | ---------- | --------------------------------------- |
| `findUnique(where, fields, options)`                 | `query`    | Get a unique model data                 |
| `findFirst(where, fields, options)`                    | `query`    | Get first matched model data            |
| `findMany(fields, options)`                          | `query`    | Get all data for model                  |
| `create(data, fields, options)`                      | `mutation` | Create a data entry for model           |
| `update(where, data, fields, options)`               | `mutation` | Update a data entry for model           |
| `upsert(where, { create, update }, fields, options)` | `mutation` | Update or create a data entry for model |
| `updateMany(where, data, fields, options)`           | `mutation` | Update many data entries for model      |
| `delete(where, fields, options)`                     | `mutation` | Delete a data entry                     |
| `deleteMany(where, fields, options)`                 | `mutation` | Delete many matching data entry         |

The above queries/mutations are called dynamically when using this package. They must be implemented server-side.



### Custom methods and overrides

```javascript
import { Graph as Base } from '@moirei/agile-graphql'

class Graph extends Base{
    // override `findUnique` for `users`
    async usersFindUnique(where){
        ...
        return user
    }

    // add new methods
    async usersAdmins(where){
        ...
        return admins
    }
}

...
const graph = new Graph(apollo)

const active_admins = await graph.users.admins({ activated: true })
```



### Use with Vue Plugin

```javascript
import Vue from 'vue'
import { VuePlugin } from '@moirei/agile-graphql'

// config is optional
Vue.use(VuePlugin, config)

....
  methods: {
    async getUsers() {
      const users = await this.$graph.users.findMany()
      console.log('run', users)
      return users
    },
  },
...
```



### Use Query Mapper (Vue)

First install [Vue Apollo](https://apollo.vuejs.org/) and the Plugin.

```javascript
import { mapQueries } from '@moirei/agile-graphql'

...
data: () => ({
    where: {
        // id: 'da15d87e-ae72-11eb-8529-0242ac130003',
        email: 'augustusokoye@moirei.com',
    },
    query: ['id', 'created_at', 'name', 'email'],
}),
computed: {
    ...mapQueries({
      users: {
        default: [], // optional
        params: ['query'], // Optional. Pass local variables to query
        query: 'users.findMany',
      },
      user: {
        params: ['where', 'query'],
        query: 'users.findUnique',
      },
      reviews: 'reviews.findMany', // default fields must be specified in config
    }),
  },
...
```





## Dependencies

* [apollo-client](https://www.npmjs.com/package/apollo-client)
* [Vue 2](https://www.npmjs.com/package/vue) to use `Mappers`



## Credits

* [Augustus Okoye](https://github.com/augustusnaz)



## License

[MIT](https://choosealicense.com/licenses/mit/)