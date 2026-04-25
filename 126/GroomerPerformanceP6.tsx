import { Card } from '@/components/ui/card'

export default function GroomerPerformanceP6() {
  return (
    <div className="h-full w-full p-6">
      <div className="grid grid-cols-3 grid-rows-4 gap-4 h-full">
        <Card className="col-span-1 row-span-1 flex items-center justify-center text-4xl font-bold">
          1
        </Card>
        <Card className="col-span-1 row-span-1 flex items-center justify-center text-4xl font-bold">
          2
        </Card>
        <Card className="col-span-1 row-span-1 flex items-center justify-center text-4xl font-bold">
          3
        </Card>
        
        <Card className="col-span-1 row-span-2 flex items-center justify-center text-4xl font-bold">
          4
        </Card>
        <Card className="col-span-1 row-span-2 flex items-center justify-center text-4xl font-bold">
          5
        </Card>
        <Card className="col-span-1 row-span-2 flex items-center justify-center text-4xl font-bold">
          6
        </Card>
        
        <Card className="col-span-1 row-span-4 flex items-center justify-center text-4xl font-bold">
          7
        </Card>
        <div className="col-span-1 row-span-2 flex flex-col gap-4">
          <Card className="flex-1 flex items-center justify-center text-4xl font-bold">
            8
          </Card>
          <Card className="flex-1 flex items-center justify-center text-4xl font-bold">
            9
          </Card>
        </div>
        <Card className="col-span-1 row-span-4 flex items-center justify-center text-4xl font-bold">
          10
        </Card>
      </div>
    </div>
  )
}
