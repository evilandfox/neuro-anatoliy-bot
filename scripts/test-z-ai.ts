import OpenAI from 'openai'

const baseURL = 'https://api.z.ai/api/paas/v4'
const apiKey = '30381db3c99f442f9e14e243dcab11e1.jcoFwumJLZG36VOz'

const main = async () => {
  const zai = new OpenAI({
    apiKey,
    baseURL,
  })

  console.log('Отправка запроса к Z.AI...')

  try {
    const stream = await zai.chat.completions.create({
      model: 'glm-4.5',
      messages: [
        { role: 'user', content: 'Расскажи короткую шутку про программиста' },
      ],
      stream: true,
    })

    console.log('Ответ от Z.AI:')
    for await (const chunk of stream) {
      console.log(chunk.choices[0]?.delta?.content || '')
    }
    console.log('\n\nЗапрос выполнен.')
  } catch (error) {
    console.error('Произошла ошибка при запросе к Z.AI:', error)
  }
}

main().catch(console.error)
