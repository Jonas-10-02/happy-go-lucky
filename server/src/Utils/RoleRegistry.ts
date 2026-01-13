import { Database } from "sqlite";
import { RoleKey } from "../ValueTypes/UserRole";
import { IllegalArgumentException } from "../Exceptions/IllegalArgumentException";


class RoleRegistry {
    private keyToId = new Map<number, RoleKey>();
    private initialized = false;

    async init(db: Database) {
        try {
            const rows = await db.all<{ id: number, userRole: string }[]>(`SELECT id, userRole FROM roles`);
            rows.forEach(({ id, userRole }) => {
                this.keyToId.set(id, userRole as RoleKey);
            });
            this.initialized = true;
        } catch (error: any) {
            console.error("Error while fetching user roles", error);
        }
    }

    getId(role: RoleKey): number {
        if (!this.initialized) {
            throw new Error("RoleRegistry not initialized");
        }
        let id: any = undefined;
        this.keyToId.forEach((value: RoleKey, key: number) => {
            if (role == value) id = key;
        });
        if (!id) {
            throw new IllegalArgumentException(`Unknown Role: ${role}`);
        }
        return id;
    }

    getRoleKey(id: number): RoleKey {
        if (!this.initialized) {
            throw new Error("RoleRegistry not initialized");
        }
        if (!id) {
            throw new IllegalArgumentException(`Invalid role id: ${id}`);
        }
        const role = this.keyToId.get(id);
        if(!role) {
            throw new IllegalArgumentException(`Unknown id: ${id}`);
        }
        return role as RoleKey;
    }
}

export const roleRegistry = new RoleRegistry();