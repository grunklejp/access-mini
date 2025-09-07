```ts
const postDefinition = createPermissionDefinition('post', {
  create:  ({actor: Actor, entity: Post, attributes: Attributes}) => {
    //        ^ types are defined here, only required is actor. 
        return true;
    }
  });

const permissions = createPermissions().add(postDefinition)


// we have access to builder pattern api like this
const canPost = permissions.get('post').can(Actor).create(Entity).with(Attributes);
//                          ^ typesafe whole way through.

// but also normal function api
const canPost = permissions.can('post', {
  actor,
  entity,
  attributes
});
//    ^ typesafe whole way through.
```





