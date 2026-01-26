import * as fossflow from 'fossflow/dist/standalone.js';

const { modelSchema } = fossflow.default || fossflow;

/**
 * Validates a diagram model using the shared FossFLOW schema.
 * @param {Object} data The diagram data to validate
 * @returns {Object} { success: boolean, errors: string[] | null }
 */
export function validateDiagram(data) {
    try {
        // If it's a list or empty, safeParse will handle it, 
        // but the diagram expects a specific object structure.
        const result = modelSchema.safeParse(data);

        if (!result.success) {
            // Map Zod errors to readable strings
            const errorMessages = result.error.errors.map(
                (e) => `• ${e.path.join('.') || 'root'}: ${e.message}`
            );
            return {
                success: false,
                errors: errorMessages
            };
        }

        return {
            success: true,
            errors: null
        };
    } catch (error) {
        console.error('Validation engine error:', error);
        return {
            success: false,
            errors: ['Internal validation error: ' + error.message]
        };
    }
}
