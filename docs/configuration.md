# Configuration

```javascript
{
    proxy: false, // if false, undefined crud methods will not resolve
    defaults: {
        keyField: 'id', // default model key field
        query: {
            findUnique: ['id', 'name'],
            // accepts: `findUnique`, `findOne`, `findMany`, `create`, `update`
            // `upsert`, `updateMany`, `delete`, `deleteMany`
        },
    },
    crud: {
        users: {
            query: ['id', 'name'],
            // fetchPolicy: 'no-cache',
            fetchPolicy: {
                findUnique: 'standby',
            },
            methods: {
                except: ['findOne'], // allow all methods for `users` except `findOne`
                only: ['findUnique', 'findMany'], // allow `findUnique` and `findMany` methods for `users`
            }
        },
        reviews: {
            ...
        },
    }
}
```

