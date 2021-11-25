import { BaseEntity, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'grails_user_roles' })
export default class UserRole extends BaseEntity {
  @PrimaryColumn({ name: 'user_id' })
  userId: number

  @PrimaryColumn({ name: 'role_id' })
  roleId: number
}
