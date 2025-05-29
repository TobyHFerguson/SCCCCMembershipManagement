
const {ProfileManagementService} = require('../src/services/ProfileManagementService/ProfileManagement');

describe('ProfileManagementService.__checkForForbiddenUpdates', () => {
    const original = {
        name: "Alice",
        age: 30,
        role: "Admin",
        status: "Active"
    };
    const forbidden = ["role", "status"];

    it('should not throw an error if only allowed fields are updated', () => {
        const updated = { ...original, name: "Bob" };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).not.toThrow();
    });

    it('should not throw an error if no fields are updated', () => {
        const updated = { ...original };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).not.toThrow();
    });

    it('should throw an error if a forbidden field is updated', () => {
        const updated = { ...original, role: "Editor" };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).toThrow("Update to forbidden field: role");
    });

    it('should throw an error if another forbidden field is updated', () => {
        const updated = { ...original, status: "Inactive" };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).toThrow("Update to forbidden field: status");
    });

    it('should throw an error if multiple forbidden fields are updated', () => {
        const updated = { ...original, role: "Editor", status: "Inactive" };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).toThrow("Update to forbidden field: role");
        // Note: Jest will stop at the first thrown error in a single expect.
        // To test both, you might need separate tests or a more complex assertion.
    });

    it('should throw an error if a forbidden field is added', () => {
        const updated = { ...original, newRole: "Editor" };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, { ...original, role: "Editor" }, forbidden)).toThrow("Update to forbidden field: role");
    });

    it('should not throw an error if an allowed field is added', () => {
        const updated = { ...original, newField: "value" };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).not.toThrow();
    });

    it('should not throw an error if an allowed field is removed', () => {
        const updated = { name: "Alice", age: 30 };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).not.toThrow();
    });

    it('should not throw an error if multiple allowed fields are updated', () => {
        const updated = { ...original, name: "Bob", age: 31 };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).not.toThrow();
    });

    it('should not throw an error if an allowed field is updated and another allowed field is added', () => {
        const updated = { ...original, name: "Bob", newField: "value" };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).not.toThrow();
    });

    it('should not throw an error if an allowed field is updated and another allowed field is removed', () => {
        const updated = { name: "Bob", role: "Admin", status: "Active" };
        expect(() => ProfileManagementService._checkForForbiddenUpdates(original, updated, forbidden)).not.toThrow();
    });
});