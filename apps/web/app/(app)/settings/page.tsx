import { SettingsForm } from './_components/settings-form'
import { PageHeader } from '@/components/page-header'

const SettingsPage = () => {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Account settings"
        description="Update your profile and password. Email changes aren't supported yet."
      />
      <SettingsForm />
    </div>
  )
}

export default SettingsPage
