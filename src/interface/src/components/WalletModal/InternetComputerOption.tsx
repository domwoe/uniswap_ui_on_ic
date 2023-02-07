import { Connector } from '@web3-react/types'
import INTERNET_COMPUTER_ICON_URL from 'assets/images/internetComputerIcon.svg'
import { ConnectionType, InternetComputerConnection } from 'connection'
import { getConnectionName } from 'connection/utils'

import Option from './Option'

const BASE_PROPS = {
  color: '#315CF5',
  icon: INTERNET_COMPUTER_ICON_URL,
  id: 'internet-computer-wallet',
}

export function InternetComputerOption({ tryActivation }: { tryActivation: (connector: Connector) => void }) {
  const isActive = InternetComputerConnection.hooks.useIsActive()
  return (
    <Option
      {...BASE_PROPS}
      isActive={isActive}
      onClick={() => tryActivation(InternetComputerConnection.connector)}
      header={getConnectionName(ConnectionType.INTERNET_COMPUTER)}
    />
  )
}
