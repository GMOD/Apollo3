import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { Button } from '@material-ui/core'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode, getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

function ApolloAuth({ model }: { model: IAnyStateTreeNode }) {
  const rootModel = getRoot(model)
  // Get session account key
  const sessionAccountTokenKey =
    rootModel.internetAccounts[0].getSessionAccountKey()
  const [, setToken] = useState(
    sessionStorage.getItem(sessionAccountTokenKey) || '',
  )

  return (
    <>
      <BaseCard title="Login">
        <div>
          <Button
            variant="contained"
            style={{ margin: 10 }}
            onClick={async () => {
              const newToken =
                await rootModel.internetAccounts[0].openLocation()
              setToken(newToken)
            }}
            disabled={!!sessionStorage.getItem(sessionAccountTokenKey)}
          >
            Login
          </Button>
        </div>
        <div>
          <Button
            variant="contained"
            style={{ margin: 10 }}
            onClick={async () => {
              Logout(sessionAccountTokenKey)
            }}
            disabled={!sessionStorage.getItem(sessionAccountTokenKey)}
          >
            Logout
          </Button>
        </div>
      </BaseCard>
    </>
  )
}

export default observer(ApolloAuth)
function Logout(inputParam: string) {
  // Let's delete old entry (if any) from session storage.
  // TODO: After logout, currently does not show Login button as enabled before userrefreshes page
  sessionStorage.removeItem(inputParam)
}
