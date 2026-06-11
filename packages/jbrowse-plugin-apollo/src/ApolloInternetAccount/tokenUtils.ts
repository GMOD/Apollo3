export interface ApolloTokenAccount {
  tokenKey: string
  removeToken(): void
}

export function revokeOtherApolloTokens(
  apolloAccounts: ApolloTokenAccount[],
  currentTokenKey: string,
) {
  for (const internetAccount of apolloAccounts) {
    if (internetAccount.tokenKey !== currentTokenKey) {
      internetAccount.removeToken()
    }
  }
}
