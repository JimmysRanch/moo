import type { Service } from '@/hooks/data/useServices'

function compareServices(left: Service, right: Service) {
  if (left.display_order !== right.display_order) {
    return left.display_order - right.display_order
  }

  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at)
  }

  return left.id.localeCompare(right.id)
}

export function getOrderedServicesByType(
  services: Service[],
  serviceType: 'main' | 'addon'
): Service[] {
  return services
    .filter((service) => service.service_type === serviceType)
    .sort(compareServices)
}

export function swapServiceDisplayOrder(
  services: Service[],
  serviceId: string,
  serviceType: 'main' | 'addon',
  direction: 'up' | 'down'
): Service[] {
  const typedServices = getOrderedServicesByType(services, serviceType)
  const index = typedServices.findIndex((service) => service.id === serviceId)

  if (index === -1) return services

  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= typedServices.length) return services

  const reorderedTypedServices = [...typedServices]
  const [movedService] = reorderedTypedServices.splice(index, 1)
  reorderedTypedServices.splice(newIndex, 0, movedService)

  const normalizedDisplayOrderById = new Map(
    reorderedTypedServices.map((service, orderedIndex) => [service.id, orderedIndex] as const)
  )

  return services
    .map((service) => {
      const normalizedDisplayOrder = normalizedDisplayOrderById.get(service.id)
      if (service.service_type === serviceType && normalizedDisplayOrder !== undefined) {
        return { ...service, display_order: normalizedDisplayOrder }
      }

      return service
    })
    .sort(compareServices)
}

export function getChangedServiceOrders(
  currentServices: Service[],
  reorderedServices: Service[],
  serviceType: 'main' | 'addon'
) {
  const currentDisplayOrderById = new Map(
    currentServices
      .filter((service) => service.service_type === serviceType)
      .map((service) => [service.id, service.display_order] as const)
  )

  return reorderedServices.filter((service) =>
    service.service_type === serviceType &&
    currentDisplayOrderById.get(service.id) !== service.display_order
  )
}
