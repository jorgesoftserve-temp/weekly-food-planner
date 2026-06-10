import { SettingsForm } from './_components/settings-form'
import { AppearanceCard } from './_components/appearance-card'
import { DietaryPreferencesCard } from './_components/dietary-preferences-card'
import { MealScheduleCard } from './_components/meal-schedule-card'
import { IdentityHeader } from './_components/identity-header'

const SettingsPage = () => {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <IdentityHeader />
      <SettingsForm />
      <AppearanceCard />
      <DietaryPreferencesCard />
      <MealScheduleCard />
    </div>
  )
}

export default SettingsPage
