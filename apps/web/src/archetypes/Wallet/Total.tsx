import { totalSelectedAccountsFiatBalance } from '@domains/balances/recoils'
import { CircularProgressIndicator } from '@talismn/ui'
import { Suspense } from 'react'
import { useRecoilValue } from 'recoil'

const TotalSuspense = () => {
  const fiatTotal = useRecoilValue(totalSelectedAccountsFiatBalance)

  // TODO: move these value into balances lib
  // const crowdloanTotal = useTotalCrowdloanTotalFiatAmount()
  // const totalStaked = useTotalStaked()

  const totalPortfolioValue = fiatTotal

  return (
    <>
      {totalPortfolioValue.toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
      })}
    </>
  )
}

const Total = () => {
  return (
    <Suspense fallback={<CircularProgressIndicator />}>
      <TotalSuspense />
    </Suspense>
  )
}

export default Total
