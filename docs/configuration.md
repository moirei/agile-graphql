# Configuration

```javascript
{
    proxy: false, // if false, undefined crud methods will not resolve
    defaults: {
        keyField: 'id', // default model key field
        query: {
            findUnique: ['id', 'name'],
            // accepts: `findUnique`, `findFirst`, `findMany`, `create`, `update`
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
                except: ['findFirst'], // allow all methods for `users` except `findFirst`
                only: ['findUnique', 'findMany'], // allow `findUnique` and `findMany` methods for `users`
            }
        },
        reviews: {
            ...
        },
    }
}
```

