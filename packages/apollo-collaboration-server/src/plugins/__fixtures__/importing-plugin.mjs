// A plugin bundle that, like most real plugins, imports Apollo packages
// rather than bundling its own copies of them.
import { ApolloServerPlugin } from '@apollo-annotation/common/server'

export default class ImportingPlugin extends ApolloServerPlugin {
  name = 'ImportingPlugin'
}
