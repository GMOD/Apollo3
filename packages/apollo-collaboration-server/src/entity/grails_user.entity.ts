import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
@Entity({ name: 'grails_user' })
export default class ApolloUser extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'version' })
  version: number

  @Column({ name: 'first_name' })
  firstName: string

  @Column({ name: 'last_name' })
  lastName: string

  @Column({ name: 'inactive' })
  inactive: boolean

  @Column({ name: 'metadata' })
  metadata: string

  @Column({ name: 'password_hash' })
  passwordHash: string

  @Column({ name: 'username' })
  userName: string
}
