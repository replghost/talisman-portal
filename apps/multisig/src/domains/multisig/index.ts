import { Chain, Token, chainTokensByIdQuery, supportedChains } from '@domains/chains'
import { accountsState } from '@domains/extension'
import BN from 'bn.js'
import { atom, selector, useRecoilState } from 'recoil'
import { recoilPersist } from 'recoil-persist'

const { persistAtom } = recoilPersist()

const dummyMultisig: Multisig = {
  name: 'Dummy Multisig',
  chain: supportedChains[0] as Chain,
  signers: [],
  threshold: 0,
  multisigAddress: '',
  proxyAddress: '',
  balances: [],
  pendingTransactions: [],
  confirmedTransactions: [],
}

export const multisigsState = atom<Multisig[]>({
  key: 'Multisigs',
  default: [],
  effects_UNSTABLE: [persistAtom],
})

export const userSelectedMultisigState = atom<Multisig | undefined>({
  key: 'UserSelectedMultisig',
  default: undefined,
})

export const activeMultisigsState = selector({
  key: 'ActiveMultisigs',
  get: ({ get }) => {
    const multisigs = get(multisigsState)
    const accounts = get(accountsState)

    return multisigs.filter(multisig => {
      return multisig.signers.some(signer => accounts.some(account => account.address === signer))
    })
  },
})

export const selectedMultisigState = selector<Multisig>({
  key: 'SelectedMultisig',
  get: ({ get }) => {
    const userSelected = get(userSelectedMultisigState)
    const activeMultisigs = get(activeMultisigsState)
    if (userSelected !== undefined && activeMultisigs.find(multisig => multisig === userSelected)) {
      return userSelected
    }

    if (activeMultisigs.length > 0) {
      return activeMultisigs[0] as Multisig
    } else {
      // Tmp return value so it doesn't crash when it navigates back to the create or landing page
      return dummyMultisig
    }
  },
  dangerouslyAllowMutability: true, // pjs wsprovider mutates itself to track connection msg stats
})

export const selectedMultisigChainTokensState = selector<Token[]>({
  key: 'SelectedMultisigChainTokens',
  get: ({ get }) => {
    const multisig = get(selectedMultisigState)
    const tokens = get(chainTokensByIdQuery(multisig.chain.id))
    return tokens
  },
})

// Returns the next connected signer that needs to sign the transaction,
// or undefined if there are none that can sign
export const useNextTransactionSigner = (approvals: TransactionApprovals | undefined) => {
  const [extensionAccounts] = useRecoilState(accountsState)

  if (!approvals) return
  return extensionAccounts.find(account => approvals[account.address] === false)
}

export enum TransactionType {
  MultiSend,
  Transfer,
  Advanced,
}

export interface AugmentedAccount {
  address: string
  you?: boolean
  nickname?: string
}

export interface Multisig {
  name: string
  chain: Chain
  multisigAddress: string
  proxyAddress: string
  signers: string[]
  threshold: number
  balances: Balance[]
  pendingTransactions: Transaction[]
  confirmedTransactions: Transaction[]
}

export interface Balance {
  token: Token
  amount: BN
}

export interface TransactionRecipient {
  address: string
  balance: Balance
}

export interface TransactionApprovals {
  [key: string]: string | false
}

export interface Transaction {
  createdTimestamp: Date
  executedTimestamp?: Date
  description: string
  hash: string
  chainId: string
  approvals: TransactionApprovals
  decoded: {
    type: TransactionType
    recipients: TransactionRecipient[]
    changeMultisigAddressDetails?: {
      signers: string[]
      threshold: number
    }
  }
  callData: `0x${string}`
}

export const calcSumOutgoing = (t: Transaction): Balance[] => {
  return t.decoded.recipients.reduce((acc: Balance[], r) => {
    const tokenId = r.balance.token.id
    const existingIndex = acc.findIndex(a => a.token.id === tokenId)
    if (existingIndex !== -1) {
      const existing = acc[existingIndex] as Balance
      const updatedBalance = {
        ...existing,
        amount: existing.amount.add(r.balance.amount),
      }
      acc[existingIndex] = updatedBalance
    } else {
      acc.push({ ...r.balance })
    }
    return acc
  }, [])
}

export const EMPTY_BALANCE: Balance = {
  token: {
    id: 'polkadot',
    coingeckoId: 'polkadot',
    logo: 'https://raw.githubusercontent.com/TalismanSociety/chaindata/v3/assets/chains/polkadot.svg',
    type: 'native',
    symbol: 'DOT',
    decimals: 10,
    chain: {
      id: 'polkadot',
    },
  },
  amount: new BN(0),
}
