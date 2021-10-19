import {Entity, PrimaryGeneratedColumn, Column, BaseEntity} from "typeorm";

@Entity()
export default class Grails_user extends BaseEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    version: number;

    @Column()
    first_name: string;

    @Column()
    last_name: string;

    @Column()
    inactive: boolean;

    @Column()
    metadata: string;

    @Column()
    password_hash: string;

    @Column()
    username: string;

}