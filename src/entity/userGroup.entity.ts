import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany} from "typeorm";

@Entity({ name:'user_group' })
export default class UserGroup extends BaseEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name:'version' })
    version: number;

    @Column({ name:'metadata' })
    metadata: string;

    @Column({ name:'first_name' })
    firstName: string;

    @Column({ name:'name' })
    groupName: string;

    @Column({ name:'public_group' })
    publicGroup: number;

    //    @OneToMany(mappedBy = "userId", cascade = CascadeType.ALL)
//    private List<UserRole> userRoles = new ArrayList<>();
}