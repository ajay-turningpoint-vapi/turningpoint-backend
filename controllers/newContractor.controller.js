import NewContractor from "../models/newContractor.modal";

export const addNewContractor = async (req, res, next) => {
    try {
        const { phone, name } = req.body;
        if (!phone) {
            return res.status(400).json({ message: "Phone number is required" });
        }
        const existingContractor = await NewContractor.findOne({ phone });
        if (existingContractor) {
            return res.status(400).json({ message: "Phone number is already in use" });
        }
        const newContractor = await NewContractor.create({ phone, name });
        res.status(201).json({ message: "Contractor created successfully", data: newContractor });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getNewContractor = async (req, res, next) => {
    try {
        const contractors = await NewContractor.find();
        res.status(200).json({ data: contractors });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const updateNewContractorById = async (req, res, next) => {
    try {
        const contractorId = req.params.id;
        const { phone, name } = req.body;

        // Check if phone number is provided
        if (!phone) {
            return res.status(400).json({ message: "Phone number is required" });
        }

        // Check if the phone number is unique, excluding the current contractor
        const existingContractor = await NewContractor.findOne({ phone, _id: { $ne: contractorId } });
        if (existingContractor) {
            return res.status(400).json({ message: "Phone number is already in use" });
        }

        const updatedContractor = await NewContractor.findByIdAndUpdate(contractorId, { phone, name, isActive, role }, { new: true });
        res.status(200).json({ message: "Contractor updated successfully", data: updatedContractor });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const deleteNewContractorById = async (req, res, next) => {
    try {
        const contractorId = req.params.id;

        // Check if the contractor exists
        const existingContractor = await NewContractor.findById(contractorId);
        if (!existingContractor) {
            return res.status(404).json({ message: "Contractor not found" });
        }

        const deletedContractor = await NewContractor.findByIdAndDelete(contractorId);
        res.status(200).json({ message: "Contractor deleted successfully", data: deletedContractor });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
