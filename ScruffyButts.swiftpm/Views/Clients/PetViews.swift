import SwiftUI

struct AddPetView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss

    var clientId: UUID
    @State private var name = ""
    @State private var species = "Dog"
    @State private var breed = ""
    @State private var weight: Double = 0
    @State private var birthday: Date = Date()
    @State private var hasBirthday = false
    @State private var groomingPreferences = ""
    @State private var medicalNotes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("About") {
                    TextField("Name", text: $name)
                    Picker("Species", selection: $species) {
                        ForEach(["Dog", "Cat", "Other"], id: \.self) { Text($0).tag($0) }
                    }
                    TextField("Breed", text: $breed)
                    HStack {
                        Text("Weight")
                        Spacer()
                        TextField("lb", value: $weight, formatter: numberFormatter)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                    Toggle("Birthday known", isOn: $hasBirthday)
                    if hasBirthday {
                        DatePicker("Birthday", selection: $birthday, displayedComponents: .date)
                    }
                }
                Section("Grooming preferences") {
                    TextEditor(text: $groomingPreferences).frame(minHeight: 70)
                }
                Section("Medical / behavioural notes") {
                    TextEditor(text: $medicalNotes).frame(minHeight: 70)
                }
            }
            .navigationTitle("Add pet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let pet = Pet(
                            clientId: clientId,
                            name: name,
                            species: species,
                            breed: breed,
                            weightLb: weight,
                            birthday: hasBirthday ? birthday : nil,
                            groomingPreferences: groomingPreferences,
                            medicalNotes: medicalNotes
                        )
                        data.upsert(pet: pet)
                        dismiss()
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }

    private var numberFormatter: NumberFormatter {
        let f = NumberFormatter(); f.maximumFractionDigits = 1; return f
    }
}

struct EditPetView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State var pet: Pet
    @State private var hasBirthday: Bool = false
    @State private var birthday: Date = Date()

    var body: some View {
        Form {
            Section("About") {
                TextField("Name", text: $pet.name)
                Picker("Species", selection: $pet.species) {
                    ForEach(["Dog", "Cat", "Other"], id: \.self) { Text($0).tag($0) }
                }
                TextField("Breed", text: $pet.breed)
                HStack {
                    Text("Weight")
                    Spacer()
                    TextField("lb", value: $pet.weightLb, formatter: numberFormatter)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                }
                Toggle("Birthday known", isOn: $hasBirthday)
                if hasBirthday {
                    DatePicker("Birthday", selection: $birthday, displayedComponents: .date)
                }
            }
            Section("Grooming preferences") {
                TextEditor(text: $pet.groomingPreferences).frame(minHeight: 70)
            }
            Section("Medical / behavioural notes") {
                TextEditor(text: $pet.medicalNotes).frame(minHeight: 70)
            }
            Section {
                Button(role: .destructive) {
                    data.deletePet(pet.id)
                    dismiss()
                } label: { Label("Delete pet", systemImage: "trash") }
            }
        }
        .navigationTitle(pet.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    pet.birthday = hasBirthday ? birthday : nil
                    data.upsert(pet: pet)
                    dismiss()
                }
            }
        }
        .onAppear {
            hasBirthday = pet.birthday != nil
            birthday = pet.birthday ?? Date()
        }
    }

    private var numberFormatter: NumberFormatter {
        let f = NumberFormatter(); f.maximumFractionDigits = 1; return f
    }
}
