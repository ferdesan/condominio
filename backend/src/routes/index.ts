import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { announcementRouter } from '@/modules/announcements/announcement.routes';
import { assemblyRouter, pollRouter } from '@/modules/assemblies/assembly.routes';
import { auditRouter } from '@/modules/audit/audit.routes';
import { authRouter } from '@/modules/auth/auth.routes';
import { blockRouter } from '@/modules/blocks/block.routes';
import { commonAreaRouter } from '@/modules/common-areas/common-area.routes';
import { condominiumRouter } from '@/modules/condominiums/condominium.routes';
import { correspondenceRouter } from '@/modules/correspondences/correspondence.routes';
import { dashboardRouter } from '@/modules/dashboard/dashboard.routes';
import { dependentRouter } from '@/modules/dependents/dependent.routes';
import { documentRouter } from '@/modules/documents/document.routes';
import { employeeRouter } from '@/modules/employees/employee.routes';
import { financialRouter } from '@/modules/financial/financial.routes';
import { healthRouter } from '@/modules/health/health.routes';
import { incidentRouter } from '@/modules/incidents/incident.routes';
import { maintenanceRouter } from '@/modules/maintenances/maintenance.routes';
import { notificationRouter } from '@/modules/notifications/notification.routes';
import { reservationRouter } from '@/modules/reservations/reservation.routes';
import { residentRouter } from '@/modules/residents/resident.routes';
import { roleRouter } from '@/modules/roles/role.routes';
import { serviceProviderRouter } from '@/modules/service-providers/service-provider.routes';
import { tenantRouter } from '@/modules/tenants/tenant.routes';
import { unitRouter } from '@/modules/units/unit.routes';
import { userRouter } from '@/modules/users/user.routes';
import { vehicleRouter } from '@/modules/vehicles/vehicle.routes';
import { visitorRouter } from '@/modules/visitors/visitor.routes';

/**
 * Mapa completo da API v1. Rotas publicas ficam antes do `authenticate`;
 * tudo o que vier depois exige um access token valido.
 */
export const apiRouter = Router();

// --- Publico ---------------------------------------------------------------
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

// --- Autenticado -----------------------------------------------------------
apiRouter.use(authenticate);

apiRouter.use('/tenants', tenantRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/roles', roleRouter);

apiRouter.use('/condominiums', condominiumRouter);
apiRouter.use('/blocks', blockRouter);
apiRouter.use('/units', unitRouter);

apiRouter.use('/residents', residentRouter);
apiRouter.use('/dependents', dependentRouter);
apiRouter.use('/employees', employeeRouter);
apiRouter.use('/service-providers', serviceProviderRouter);
apiRouter.use('/visitors', visitorRouter);
apiRouter.use('/vehicles', vehicleRouter);
apiRouter.use('/correspondences', correspondenceRouter);

apiRouter.use('/common-areas', commonAreaRouter);
apiRouter.use('/reservations', reservationRouter);

apiRouter.use('/financial', financialRouter);

apiRouter.use('/assemblies', assemblyRouter);
apiRouter.use('/polls', pollRouter);

apiRouter.use('/announcements', announcementRouter);
apiRouter.use('/incidents', incidentRouter);
apiRouter.use('/maintenances', maintenanceRouter);
apiRouter.use('/documents', documentRouter);

apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/audit-logs', auditRouter);
