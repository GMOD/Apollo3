import { identity } from "rxjs";
import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany, PrimaryColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable} from "typeorm";
import ApolloUser from "./grails_user.entity";

@Entity({ name:'grails_user_roles' })
export default class UserRole extends BaseEntity {

    @PrimaryColumn({ name: 'user_id' } )
    userId: number;
    
    @PrimaryColumn({ name:'role_id' })
    roleId: number;
}