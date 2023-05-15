import { injectedAccountsState } from '@domains/accounts'
import { SubstrateApiContext, useChainQueryState, useSubstrateApiState } from '@domains/common'
import { useContext, useMemo } from 'react'
import { DefaultValue, atomFamily, useRecoilValue } from 'recoil'
import { Thread, spawn } from 'threads'
import { WorkerFunction } from './worker'

import { encodeAddress } from '@polkadot/util-crypto'
import { bool, coercion, jsonParser, writableDict } from '@recoiljs/refine'
import { getErasToCheck } from './utils'

const getExposureKey = (genesisHash: string) => `@talisman/portal/exposure/${genesisHash}`

const exposureChecker = writableDict(writableDict(bool()))
const exposureCoercion = coercion(exposureChecker)
const exposureJsonParser = jsonParser(exposureChecker)

const unexposedAddressesState = atomFamily<
  Record<string, boolean | undefined>,
  { endpoint: string; genesisHash: string; activeEra: number; bondingDuration: number; addresses: string[] }
>({
  default: ({ addresses }) => Object.fromEntries(addresses.map(x => [x, undefined])),
  key: 'UnexposedAddresses',
  effects: ({ endpoint, genesisHash, activeEra, bondingDuration, addresses }) => [
    ({ setSelf }) => {
      if (addresses.length === 0) {
        return
      }

      const exposure = exposureJsonParser(sessionStorage.getItem(getExposureKey(genesisHash))) ?? {}

      const storeExposure = () => {
        const coercedExposure = exposureCoercion(exposure)

        if (coercedExposure !== undefined && coercedExposure !== null) {
          sessionStorage.setItem(getExposureKey(genesisHash), JSON.stringify(coercedExposure))
        }
      }

      // Remove old precomputed eras
      const erasToCheck = new Set(getErasToCheck(activeEra, bondingDuration))
      for (const era of Object.keys(exposure)) {
        if (!erasToCheck.has(Number(era))) {
          delete exposure[era]
        }
      }

      storeExposure()

      const subscriptionPromise = spawn<WorkerFunction>(new Worker(new URL('./worker', import.meta.url))).then(worker =>
        worker(endpoint, activeEra, addresses, exposure).subscribe({
          next: ({ era, address, exposed }) => {
            if (exposed) {
              setSelf(x => ({ ...x, [encodeAddress(address)]: !exposed }))
            }

            if (era in exposure) {
              exposure[era]![address] = exposed
            } else {
              exposure[era] = { [address]: exposed }
            }

            storeExposure()
          },
          error: () => Thread.terminate(worker),
          complete: () => {
            Thread.terminate(worker)
            storeExposure()
            setSelf(x => {
              if (x instanceof DefaultValue) {
                return x
              }

              return Object.fromEntries(Object.entries(x).map(([key, value]) => [key, value ?? true]))
            })
          },
        })
      )

      return () => subscriptionPromise.then(subscription => subscription.unsubscribe())
    },
  ],
})

export const useInjectedUnexposedAccounts = () => {
  const api = useRecoilValue(useSubstrateApiState())

  const addresses = useRecoilValue(injectedAccountsState).map(x => x.address)
  const bondedAccounts = useRecoilValue(useChainQueryState('staking', 'bonded.multi', addresses))

  const addressesToRunExposureCheck = useMemo(
    () => addresses.filter((_, index) => bondedAccounts[index]?.isSome),
    [addresses, bondedAccounts]
  )

  return {
    ...useMemo(
      () =>
        Object.fromEntries(
          addresses.filter(address => !addressesToRunExposureCheck.includes(address)).map(address => [address, false])
        ),
      [addresses, addressesToRunExposureCheck]
    ),
    ...useRecoilValue(
      unexposedAddressesState({
        endpoint: useContext(SubstrateApiContext).endpoint,
        genesisHash: api.genesisHash.toHex(),
        activeEra: useRecoilValue(useChainQueryState('staking', 'activeEra', [])).unwrapOrDefault().index.toNumber(),
        bondingDuration: api.consts.staking.bondingDuration.toNumber(),
        addresses: addressesToRunExposureCheck,
      })
    ),
  }
}
