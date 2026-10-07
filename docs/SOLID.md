# Princípios SOLID no React 🚀

Este documento detalha os padrões de desenvolvimento e melhores práticas do projeto, focando na adaptação dos princípios SOLID para o desenvolvimento moderno de componentes e hooks com React.

Para manter a documentação limpa e de fácil leitura, utilizamos a técnica de **Progressive Disclosure** (Divulgação Progressiva). Clique nos cabeçalhos abaixo para expandir e aprofundar-se em cada princípio.

---

## 📐 Resumo dos Princípios

<details>
<summary><b>🔍 O que é SOLID no React? (Clique para expandir)</b></summary>

Os cinco princípios SOLID foram propostos inicialmente por Robert C. Martin ("Uncle Bob") para Programação Orientada a Objetos. No contexto do React, onde trabalhamos com componentes funcionais e Hooks, nós os adaptamos da seguinte forma:

1. **SRP (Single Responsibility Principle)**: Um componente ou Hook deve fazer apenas uma coisa.
2. **OCP (Open/Closed Principle)**: Um componente deve ser aberto para extensão, mas fechado para modificação direta.
3. **LSP (Liskov Substitution Principle)**: Um componente customizado deve aceitar e herdar propriedades do elemento nativo que ele encapsula.
4. **ISP (Interface Segregation Principle)**: Componentes não devem depender de propriedades inteiras de objetos complexos se precisarem apenas de alguns valores.
5. **DIP (Dependency Inversion Principle)**: Componentes de alto nível não devem depender diretamente de serviços de baixo nível; dependa de abstrações ou delegue ações via Props.

</details>

---

## 1. SRP - Single Responsibility Principle (Princípio da Responsabilidade Única)

<details>
<summary><b>⚡ Veja como aplicar o SRP e separar lógica de renderização (Clique para expandir)</b></summary>

### O Conceito
Um componente React deve ser responsável apenas pela exibição visual ou por uma parte lógica muito específica. **Não misture requisições HTTP, formatações de dados complexas e renderização de layouts no mesmo arquivo.**

### ❌ Exemplo Incorreto (Violando o SRP)
```tsx
// Componente que renderiza, gerencia estado de busca e faz fetch de dados
export const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Carregando...</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name.toUpperCase()}</li>
      ))}
    </ul>
  );
};
```

### ✅ Exemplo Correto (Seguindo o SRP)
1. **Criar um Custom Hook para gerenciar o estado e fetch (Lógica separada):**
```tsx
// useUsers.ts
export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      });
  }, []);

  return { users, loading };
};
```

2. **Deixar o Componente responsável apenas pela renderização visual:**
```tsx
// UserList.tsx
import { useUsers } from "./useUsers";

export const UserList = () => {
  const { users, loading } = useUsers();

  if (loading) return <div>Carregando...</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name.toUpperCase()}</li>
      ))}
    </ul>
  );
};
```

</details>

---

## 2. OCP - Open/Closed Principle (Princípio Aberto/Fechado)

<details>
<summary><b>🧩 Veja como criar componentes altamente extensíveis usando Slots e Children (Clique para expandir)</b></summary>

### O Conceito
Os componentes devem ser criados de forma que possam receber novos comportamentos ou elementos visuais **sem que seja necessário modificar seu código interno**. No React, fazemos isso usando `children`, render props ou slots.

### ❌ Exemplo Incorreto (Violando o OCP)
```tsx
// Se quisermos adicionar um novo ícone ou link no Header, precisamos alterar este arquivo diretamente
export const Header = ({ showSearch, showProfile }) => {
  return (
    <header className="flex justify-between items-center p-4">
      <Logo />
      <div className="flex gap-4">
        {showSearch && <SearchInput />}
        {showProfile && <ProfileMenu />}
      </div>
    </header>
  );
};
```

### ✅ Exemplo Correto (Seguindo o OCP)
```tsx
// Usando Slots para permitir que quem consome o Header insira o que quiser nas extremidades
interface HeaderProps {
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
}

export const Header = ({ leftActions, rightActions }: HeaderProps) => {
  return (
    <header className="flex justify-between items-center p-4">
      <div className="flex items-center gap-4">
        <Logo />
        {leftActions}
      </div>
      <div className="flex items-center gap-4">
        {rightActions}
      </div>
    </header>
  );
};
```

</details>

---

## 3. LSP - Liskov Substitution Principle (Princípio da Substituição de Liskov)

<details>
<summary><b>🛠️ Veja como estender propriedades HTML nativas corretamente (Clique para expandir)</b></summary>

### O Conceito
Subclasses ou componentes derivados devem ser capazes de substituir seus tipos base sem quebrar o comportamento do sistema. Em componentes React que envelopam tags HTML (ex: botões, inputs), devemos **estender as propriedades HTML originais** para que o componente herde todos os atributos padrão (como `disabled`, `onClick`, `type`, etc.).

### ❌ Exemplo Incorreto (Violando o LSP)
```tsx
// Este botão ignora propriedades padrão do HTML como type, disabled, ou autofocus
interface CustomButtonProps {
  label: string;
  onClick: () => void;
}

export const CustomButton = ({ label, onClick }: CustomButtonProps) => {
  return (
    <button onClick={onClick} className="px-4 py-2 bg-blue-500 text-white font-medium rounded">
      {label}
    </button>
  );
};
```

### ✅ Exemplo Correto (Seguindo o LSP)
```tsx
import React from "react";

// Estende diretamente as propriedades nativas do elemento button do HTML
interface CustomButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export const CustomButton = ({ label, className = "", ...props }: CustomButtonProps) => {
  return (
    <button 
      className={`px-4 py-2 bg-blue-500 text-white font-medium rounded hover:bg-blue-600 transition-colors ${className}`}
      {...props} // Repassa todas as propriedades nativas (onClick, disabled, type, etc.)
    >
      {label}
    </button>
  );
};
```

</details>

---

## 4. ISP - Interface Segregation Principle (Princípio da Segregação de Interfaces)

<details>
<summary><b>📦 Veja como desacoplar componentes de objetos e tipos gigantescos (Clique para expandir)</b></summary>

### O Concept
Um componente não deve depender de mais propriedades do que ele realmente necessita. Evite passar objetos inteiros e complexos para subcomponentes que usam apenas uma ou duas propriedades primitivas.

### ❌ Exemplo Incorreto (Violando o ISP)
```tsx
interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
  createdAt: Date;
}

// O componente de Avatar só precisa de avatarUrl e name, mas exige o objeto inteiro de User
export const UserAvatar = ({ user }: { user: User }) => {
  return (
    <img 
      src={user.avatarUrl} 
      alt={user.name} 
      className="w-10 h-10 rounded-full" 
    />
  );
};
```

### ✅ Exemplo Correto (Seguindo o ISP)
```tsx
// O componente agora define uma interface enxuta e específica para suas necessidades
interface UserAvatarProps {
  avatarUrl: string;
  name: string;
}

export const UserAvatar = ({ avatarUrl, name }: UserAvatarProps) => {
  return (
    <img 
      src={avatarUrl} 
      alt={name} 
      className="w-10 h-10 rounded-full" 
    />
  );
};
```

</details>

---

## 5. DIP - Dependency Inversion Principle (Princípio da Inversão de Dependência)

<details>
<summary><b>🔌 Veja como injetar dependências e testar lógica de forma desacoplada (Clique para expandir)</b></summary>

### O Conceito
Módulos de alto nível não devem depender diretamente de implementações de baixo nível (como uma biblioteca específica de fetch, ou o SDK direto do Firebase). Ambos devem depender de abstrações ou receber dependências via inversão de controle (por exemplo, callbacks ou injeção de provedores).

### ❌ Exemplo Incorreto (Violando o DIP)
```tsx
// O componente está firmemente acoplado a uma biblioteca HTTP específica (Axios)
import axios from "axios";

export const SaveButton = ({ dataToSave }) => {
  const handleSave = async () => {
    await axios.post('/api/save', dataToSave);
  };

  return <button onClick={handleSave}>Salvar</button>;
};
```

### ✅ Exemplo Correto (Seguindo o DIP)
```tsx
// O componente não sabe como os dados são salvos, ele apenas executa a ação injetada por parâmetro
interface SaveButtonProps {
  onSave: () => Promise<void>;
}

export const SaveButton = ({ onSave }: SaveButtonProps) => {
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <button onClick={handleSave} disabled={saving}>
      {saving ? "Salvando..." : "Salvar"}
    </button>
  );
};
```

</details>
