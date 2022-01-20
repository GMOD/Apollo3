class ChangeTypeRegistry {

    changes: Map<string, Change> = new Map()

    registerChange(name: string, ChangeClass: new (...args: any[]) => Change) {
        if(this.changes.has(name)) throw new Error(`change type ${name} has already been registered`)
        this.changes.set(name, ChangeClass)
    }

    getChangeClass(name:string) {
        return changes.get(name)
    }
}

/** global singleton of all known types of changes */
export const ChangeRegistry = new ChangeTypeRegistry()